import { Method } from "axios";
interface ApiCallParams {
    method: Method;
    url: string;
    data?: Record<string, any>;
    params?: Record<string, any>;
    headers?: any;
    timeout?: number;
}
export declare const apiCall: ({ method, url, data, params, headers, timeout, }: ApiCallParams) => Promise<any>;
export {};
