export interface IOhlcvRequestResponse {
    data: {
        id: string;
        type: string;
        attributes: {
            ohlcv_list: number[][];
        };
    };
}

export interface IOhlcv {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
