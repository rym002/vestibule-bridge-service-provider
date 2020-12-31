import { registerModule } from '@vestibule-link/bridge'
export { serviceProviderManager, ServiceProviderEndpointFactory, ServiceProviderConnectors, ServiceProviderType, EndpointConnector } from './providers'

let moduleId: symbol | undefined;

export function startModule() {
    if (!moduleId) {
        moduleId = registerModule({
            name: 'service-provider',
            init: async () => {
            }
        })
    }
    return moduleId;
}
