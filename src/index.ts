import {registerModule} from '@vestibule-link/bridge'
export { topicHandler, responseRouter } from './topic'
export { CommandType, EndpointEmitter, providersEmitter, Assistant } from './providers'

registerModule({
    name: 'assistant',
    init: async () => {
    }
})
