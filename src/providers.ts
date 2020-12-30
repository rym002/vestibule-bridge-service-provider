
/**
 * Merge declaration to add new service providers
 */
export interface ServiceProviderConnectors {
}

export type ServiceProviderType = keyof ServiceProviderConnectors

/**
 * Service Provider implements this factory to create endpoint connectors
 */
export interface ServiceProviderEndpointFactory<P extends ServiceProviderType> {
    readonly name: P
    createEndpointConnector(endpointId: string): Promise<ServiceProviderConnectors[P]>
}

/**
 * Single endpoint can connect to multiple service providers
 */
class ServiceProviderManager {
    readonly endpoints = new Map<string, ServiceProviderConnectors>();
    private providers = new Map<ServiceProviderType, ServiceProviderEndpointFactory<ServiceProviderType>>()

    registerServiceProvider<P extends ServiceProviderType>(provider: ServiceProviderEndpointFactory<P>): void {
        this.providers.set(provider.name, provider);
    }

    private getServiceProviderFactory(providerType: ServiceProviderType) {
        const provider = this.providers.get(providerType);
        if (!provider) {
            throw new Error(`Invalid Service Provider ${providerType}`)
        }
        return provider;
    }

    async getEndpointConnector<P extends ServiceProviderType>(providerName: P, endpointId: string, autoCreate = false): Promise<ServiceProviderConnectors[P]> {
        const endpointProviders = this.getEndpointServiceProviders(endpointId, autoCreate)
        return await this.getServiceProviderEndpointConnector(providerName, endpointId, endpointProviders, autoCreate)
    }

    private getEndpointServiceProviders(endpointId: string, autoCreate: boolean): ServiceProviderConnectors {
        let endpointProviders = this.endpoints.get(endpointId);
        if (autoCreate && !endpointProviders) {
            endpointProviders = {};
            this.endpoints.set(endpointId, endpointProviders);
        }
        if (!endpointProviders) {
            throw new Error(`Endpoint Not Found ${endpointId}`)
        }
        return endpointProviders
    }

    private async getServiceProviderEndpointConnector<P extends ServiceProviderType>(providerName: P, endpointId: string, endpointServiceProviders: ServiceProviderConnectors, autoCreate: boolean): Promise<ServiceProviderConnectors[P]> {
        let endpoint = endpointServiceProviders[providerName];
        if (!endpoint && autoCreate) {
            const serviceProvider = this.getServiceProviderFactory(providerName);
            endpoint = await serviceProvider.createEndpointConnector(endpointId);
            endpointServiceProviders[providerName] = endpoint;
        }

        if (!endpoint) {
            throw new Error(`Endpoint Service Provider Not found ${endpointId}`)
        } else {
            return endpoint;
        }
    }
}

export const serviceProviderManager = new ServiceProviderManager();