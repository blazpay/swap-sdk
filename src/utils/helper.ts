export const enum contractErrorMessage {
    EXPIRED = "Expired",
    INVALID_PATH = "Invalid path",
    EXCESSIVE_INPUT_AMOUNT = "Excessive input amount",
    INSUFFICIENT_A_AMOUNT = "Insufficient token amount",
    INSUFFICIENT_B_AMOUNT = "Insufficient token amount",
    INSUFFICIENT_OUTPUT_AMOUNT = "Insufficient output amount",
    INSUFFICIENT_VESTED_LIQUIDITY_WITH_VESTED_TIME_COMPLETED = "Insufficient vested liquidity with vested time completed"
}
export const getErrorMessage = (error: any): Boolean => {
    if(error?.message?.includes('EXPIRED'))
        return true
    else if(error?.message?.includes('INVALID_PATH'))
        return true
    else if(error?.message?.includes('EXCESSIVE_INPUT_AMOUNT'))
        return true
    else if(error?.message?.includes('INSUFFICIENT_A_AMOUNT'))
        return true
    else if(error?.message?.includes('INSUFFICIENT_B_AMOUNT'))
        return true
    else if(error?.message?.includes('INSUFFICIENT_OUTPUT_AMOUNT'))
        return true
    else if(error?.message?.includes('INSUFFICIENT_VESTED_LIQUIDITY_WITH_VESTED_TIME_COMPLETED'))
        return true
    else if(error?.message?.includes('User rejected the request.'))
        return true
    else if(error?.message?.includes('User denied transaction signature'))
        return true
    else if(error?.message?.includes('user rejected transaction'))
        return true
    else if(error?.message?.includes('Confirmation declined by user'))
        return true
    else return false
}