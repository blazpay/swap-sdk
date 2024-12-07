import { Method } from "axios";
interface ApiCallParams {
    method: Method;
    url: string;
    data?: Record<string, any> | string;
    params?: Record<string, any>;
    headers?: any;
    timeout?: number;
    withCredentials?: boolean;
}
export declare const apiCall: ({ method, url, data, params, headers, timeout, }: ApiCallParams) => Promise<any>;
export declare const post: (url: string, body: any) => Promise<Response>;
export {};
