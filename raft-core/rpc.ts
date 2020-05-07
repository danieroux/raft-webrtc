import { RaftNodeId } from './raftNode';
import { TLogEntry } from './log';
import { Result, TResult } from './lib';

const rpcGroup: {
    [memberId: string]: {  
        memberId: string,
        delegate: any,
        callIds: {
            [callId: string]: [any /* resolve */, any /* reject */]
        }
    }
} = {};

export function rpcInvoke(invokerId, receiverId, method, args) {
    const callId = Math.random();   // TODO: improve this
    const invokePayload = {
        method,
        args: JSON.stringify(args),
        invokerId,
        callId,
        __invoke: true
    };

    let responsePromise = new Promise((res, rej) => {
        // TODO: Add timeout?
        rpcGroup[invokerId].callIds[callId] = [res, rej];
    });

    // Send to receiverId with invokePayload
    fakeSend(receiverId, invokePayload);

    return responsePromise;
}

export function rpcBroadcast(invokerId, method, args) {
    return Promise.all(
        Object.values(rpcGroup).map(rpcMember => 
            rpcInvoke(invokerId, rpcMember.memberId, method, args)
        )
    );
}

async function rpcReceive(receiverId, senderPayload) {
    const isInvocation = senderPayload.__invoke === true;
    if (isInvocation) await rpcRespond(receiverId, senderPayload);
    else rpcHandleResponse(senderPayload);
}

const delegate = {};
async function rpcRespond(receiverId, senderPayload) {
    const {
        method,
        args: argsString,
        invokerId,
        callId
    } = senderPayload;

    // invoke whatever method is requested
    const args = JSON.parse(argsString);
    const result = await rpcGroup[receiverId].delegate[method].apply(null, args);

    const responsePayload = {
        result,
        invokerId,
        callId,
        __response: true
    };

    // send to senderId with responsePayload
    fakeSend(invokerId, responsePayload);
}

function rpcHandleResponse(responsePayload) {
    const {
        result,
        invokerId,
        callId
    } = responsePayload;

    // extract the result from the payload
    const [res, rej] = rpcGroup[invokerId].callIds[callId];
    delete rpcGroup[invokerId].callIds[callId];

    // resolve the promise with the result
    res(result);
}


export function rpcRegister(delegate) {
    const id = Math.random().toString();
    rpcGroup[id] = {
        memberId: id,
        delegate,
        callIds: {}
    }

    return id;
}


function fakeSend(receiverId, payload) {
    setTimeout(() => {
        fakeReceive(receiverId, payload);
    }, Math.random() * 100 + 100);
}

function fakeReceive(id, payload) {
    rpcReceive(id, payload);
}

// if (require.main === module) {
//     const idA = rpcRegister({
//         hello: (x) => {
//             console.log(`Hello ${x}!`);
//             return 'Goodbye';
//         }
//     });

//     const idB = rpcRegister({
//         speak: (y) => {
//             console.log(`Bark ${y}`);
//             return true;
//         }
//     });


//     rpcInvoke(idA, idB, 'speak', ['test']).then((r) => {
//         console.log(r);

//         rpcInvoke(idB, idA, 'hello', ['A']).then((r) => {
//             console.log(r);
//         });
//     });
// }
