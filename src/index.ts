import { registerModule } from '@vestibule-link/bridge'
export { topicHandler, responseRouter } from './topic'
export { CommandType, EndpointEmitter, providersEmitter, Assistant } from './providers'

let moduleId: symbol | undefined;

export function startModule() {
    if (!moduleId) {
        moduleId = registerModule({
            name: 'assistant',
            init: async () => {
            }
        })
    }
    return moduleId;
}
