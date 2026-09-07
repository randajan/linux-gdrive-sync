



export const mergeHandlers = (...fns)=>{
    return async (...a)=>{
        for (const fn of fns) {
            if (typeof fn !== "function") { continue; }
            await fn(...a);
        }
    }
}