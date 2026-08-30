
import { ApolloError } from 'apollo-server-errors'


export const dbErrorTypes = {
    MISS_REQUEUED_PRAMS: "MISS_REQUEUED_PRAMS",
    INVALID_VALUE: "INVALID_VALUE",
    INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
    NOTHING_TO_UPDATED: "NOTHING_TO_UPDATED",
    UNAUTHORIZED: "UNAUTHORIZED",
}


/**
 * 
 * @param {"MISS_REQUEUED_PRAMS"| "INVALID_VALUE" | "INTERNAL_SERVER_ERROR" | "UNAUTHORIZED" | "NOTHING_TO_UPDATED"} type 
 * @param {String} message
 */

export const errorGenerator = (type, message) => {

    throw new ApolloError(message, type)
}




