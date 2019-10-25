import { AssistantEndpoint, AssistantType, generateEndpointId, LocalEndpoint, Providers, SubType } from "@vestibule-link/iot-types";
import { EventEmitter } from "events";

export type CommandType = 'directive';

export interface Assistant<AT extends AssistantType> {
    readonly name: AT
    missingEndpointError: (le: LocalEndpoint, messageId: symbol) => void
    createEndpointEmitter: (endpointId: string) => EndpointEmitter<AT>
}

export interface EndpointEmitter<A extends AssistantType> {
    emit(event: 'delta', data: SubType<AssistantEndpoint, A>, deltaId: symbol): boolean
    on(event: 'delta', listener: (data: SubType<AssistantEndpoint, A>, deltaId: symbol) => void): this
    once(event: 'delta', listener: (data: SubType<AssistantEndpoint, A>, deltaId: symbol) => void): this
    removeListener(event: 'delta', listener: (data: SubType<AssistantEndpoint, A>, deltaId: symbol) => void): this
    emit(event: CommandType, commandArgs: string[], request: any, messageId: symbol): boolean
    on(event: CommandType, listener: (commandArgs: string[], request: any, messageId: symbol) => void): this
    once(event: CommandType, listener: (commandArgs: string[], request: any, messageId: symbol) => void): this
    removeListener(event: CommandType, listener: (commandArgs: string[], request: any, messageId: symbol) => void): this
    endpoint: SubType<AssistantEndpoint, A>
    refresh(deltaId: symbol): Promise<void>;
    emit(event: 'settings', data: any): boolean
    on(event: 'settings', listener: (data: any) => void): this
    once(event: 'settings', listener: (data: any) => void): this
    removeListener(event: 'settings', listener: (data: any) => void): this
}


type AssistantsEndpointEmitter = {
    [T in AssistantType]?: EndpointEmitter<T>
}

interface ProvidersEmitter {
    emit<A extends AssistantType>(event: A, provider: Providers<A>): boolean
    on<A extends AssistantType>(event: A, listener: (data: Providers<A>) => void): this
    once<A extends AssistantType>(event: A, listener: (data: Providers<A>) => void): this
    removeListener<A extends AssistantType>(event: A, listener: (data: Providers<A>) => void): this
    getEndpointEmitter<AT extends AssistantType>(assistantType: AT, localEndpoint: LocalEndpoint, autoCreate?: boolean): SubType<AssistantsEndpointEmitter, AT>
    getEndpointSettingsEmitter(assistantType: AssistantType): EndpointSettingsEmitter;
    emit(event: 'refresh' | 'pushData', assistantType: AssistantType): boolean
    emit(event: CommandType, assistant: AssistantType, commandArgs: string[], request: any, messageId: symbol): boolean
    on(event: CommandType, listener: (assistant: AssistantType, commandArgs: string[], request: any, messageId: symbol) => void): this
    once(event: CommandType, listener: (assistant: AssistantType, commandArgs: string[], request: any, messageId: symbol) => void): this
    removeListener(event: CommandType, listener: (assistant: AssistantType, commandArgs: string[], request: any, messageId: symbol) => void): this
    registerAssistant(assistant: Assistant<any>): void;
}

interface EndpointSettingsEmitter {
    emit(event: 'settings', endpointId: string, data: any): boolean
    on(event: 'settings', listener: (endpointId: string, data: any) => void): this
    once(event: 'settings', listener: (endpointId: string, data: any) => void): this
    removeListener(event: 'settings', listener: (endpointId: string, data: any) => void): this
}

class ProvidersEmitterNotifier extends EventEmitter implements ProvidersEmitter {
    readonly endpoints = new Map<string, AssistantsEndpointEmitter>();
    readonly settingsEmitters = new Map<AssistantType, EndpointSettingsEmitter>();
    private readonly refreshPromises = new Map<symbol, Promise<void>>();
    private readonly providerEndpoints = new Map<symbol, Providers<any>>();
    private assistants = new Map<AssistantType, Assistant<any>>()

    constructor() {
        super();
        this.on('refresh', this.delegateRefresh);
        this.on('directive', this.delegateDirective);
        this.on('pushData', this.delegatePush);
    }

    getEndpointSettingsEmitter(assistantType: AssistantType): EndpointSettingsEmitter {
        const ret = this.settingsEmitters.get(assistantType);
        if (!ret) {
            throw new Error('Unknown Assistant ' + assistantType);
        }
        return ret;
    }
    registerAssistant(assistant: Assistant<any>) {
        this.assistants.set(assistant.name, assistant);
        this.settingsEmitters.set(assistant.name, new EventEmitter());
    }

    private getAssistant(assistantType: AssistantType) {
        const assistant = this.assistants.get(assistantType);
        if (!assistant) {
            throw new Error('Invalid Assistant ' + assistantType)
        }
        return assistant;
    }

    getEndpointEmitter<AT extends AssistantType>(assistantType: AT, localEndpoint: LocalEndpoint, autoCreate = false): SubType<AssistantsEndpointEmitter, AT> {
        const endpointId = generateEndpointId(localEndpoint);
        let assistantsEmitter = this.endpoints.get(endpointId);
        if (autoCreate && !assistantsEmitter) {
            assistantsEmitter = {};
            this.endpoints.set(endpointId, assistantsEmitter);
        }
        if (assistantsEmitter) {
            return this.getAssistantEndpointEmitter(assistantType, endpointId, assistantsEmitter, autoCreate)
        }
    }

    private getAssistantEndpointEmitter<AT extends AssistantType>(assistantType: AT, endpointId: string, assistantsEmitter: AssistantsEndpointEmitter, autoCreate: boolean): SubType<AssistantsEndpointEmitter, AT> {
        let endpoint = assistantsEmitter[assistantType];
        if (!endpoint && autoCreate) {
            const assistant = this.getAssistant(assistantType);
            endpoint = assistant.createEndpointEmitter(endpointId);
            assistantsEmitter[assistantType] = endpoint;
            endpoint.on('delta', this.delegateDeltaEndpoint(endpointId, assistantType));
            endpoint.on('settings', this.delegateEndpointSettings(endpointId,assistantType));
        }
        return endpoint;
    }

    private emitAssistant(assistantType: AssistantType, deltaId: symbol) {
        const deltaProvider = this.providerEndpoints.get(deltaId);
        if (deltaProvider) {
            this.emit(assistantType, deltaProvider);
            this.providerEndpoints.delete(deltaId);
        }
    }

    private delegateEndpointSettings(endpointId: string,assistantType: AssistantType) {
        return (data: any) => {
            this.getEndpointSettingsEmitter(assistantType).emit('settings', endpointId, data);
        }
    }
    private delegateDeltaEndpoint<AT extends AssistantType>(endpointId: string, assistantType: AT) {
        return (endpoint: SubType<AssistantEndpoint, AT>, deltaId: symbol) => {
            let deltaProvider = this.providerEndpoints.get(deltaId);
            if (!deltaProvider) {
                deltaProvider = {};
                this.providerEndpoints.set(deltaId, deltaProvider);
            }
            deltaProvider[endpointId] = endpoint;
            if (!this.refreshPromises.has(deltaId)) {
                this.emitAssistant(assistantType, deltaId);
            }
        }
    }

    private delegatePush<AT extends AssistantType>(assistantType: AT) {
        const providerEndpoints: Providers<AT> = {};
        this.endpoints.forEach((assistantEndpoint, id) => {
            const endpointEmitter = assistantEndpoint[assistantType];
            if (endpointEmitter) {
                providerEndpoints[id] = endpointEmitter.endpoint;
            }
        })
        this.emit(assistantType, providerEndpoints);
    }

    private delegateRefresh(assistantType: AssistantType): void {
        const deltaId = Symbol();
        const promises: Promise<void>[] = []
        this.endpoints.forEach(endpoint => {
            const endpointEmitter = endpoint[assistantType];
            if (endpointEmitter) {
                const promise = endpointEmitter.refresh(deltaId);
                promises.push(promise);
            }
        })
        const refreshPromise = Promise.all(promises)
            .then(values => {
                this.refreshPromises.delete(deltaId);
                this.emitAssistant(assistantType, deltaId);
            })
        this.refreshPromises.set(deltaId, refreshPromise);
    }

    private delegateDirective(assistantType: AssistantType, commandArgs: string[], request: any, messageId: symbol) {
        const [providerId, host, ...assistantArgs] = [...commandArgs];
        const localEndpoint: LocalEndpoint = {
            host: host,
            provider: providerId
        }
        const assistant = this.getAssistant(assistantType);
        const endpointEmitter = this.getEndpointEmitter(assistantType, localEndpoint);
        if (endpointEmitter) {
            endpointEmitter.emit('directive', assistantArgs, request, messageId);
        } else {
            assistant.missingEndpointError(localEndpoint, messageId);
        }
    }
}

export const providersEmitter: ProvidersEmitter = new ProvidersEmitterNotifier();