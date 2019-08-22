import { RequestMessage, AssistantType, ResponseMessage } from "@vestibule-link/iot-types";
import { EventEmitter } from "events";
import { providersEmitter, CommandType } from "./providers";

interface ResponseRouter {
    emit(messageId: symbol, response: ResponseMessage<any>): boolean
    once(messageId: symbol, listener: (response: ResponseMessage<any>) => void): this
    emit(assistant: AssistantType, replyTopic: string, respPayload: string): boolean
    on(assistant: AssistantType, listener: (replyTopic: string, respPayload: string) => void): this
}

export const responseRouter: ResponseRouter = new EventEmitter();

function sendResponse(assistant: AssistantType, req: RequestMessage<any>, resp: ResponseMessage<any>, startTime: number): void {
    const respPayload = JSON.stringify(resp);
    const reqTimes = req.responseTime;
    let replyTopic: string | undefined = undefined;
    if (reqTimes && req.replyTopic.async) {
        const responseTime = Date.now() - startTime;
        if (responseTime < reqTimes.maxAllowed) {
            if (responseTime < reqTimes.deferred) {
                replyTopic = req.replyTopic.sync;
            } else {
                replyTopic = req.replyTopic.async;
            }
        } else {
            console.log('Not Sending Response, processing time %i', responseTime);
        }
    } else {
        replyTopic = req.replyTopic.sync;
    }
    if (replyTopic) {
        responseRouter.emit(assistant, replyTopic, respPayload);
    }
}

export async function topicHandler(topic: string, payload: string) {
    const start = Date.now()
    const parts = topic.split('/');
    const [root, clientId, assistant, command, ...remainingArgs] = [...parts];
    const jsonPayload = <RequestMessage<any>>JSON.parse(payload);
    try {
        const messageId = Symbol();
        responseRouter.once(messageId, (respPayload) => {
            sendResponse(<AssistantType>assistant, jsonPayload, respPayload, start);
        })
        providersEmitter.emit(<CommandType>command, <AssistantType>assistant, remainingArgs, jsonPayload.payload, messageId);
    } catch (e) {
        console.log(e)
    }
}