import axios, { AxiosRequestHeaders, Method } from "axios";

interface ApiCallParams {
  method: Method;
  url: string;
  data?: Record<string, any> | string;
  params?: Record<string, any>;
  headers?: any;
  timeout?: number;
}

export const apiCall = async ({
  method,
  url,
  data = {},
  params = {},
  headers,
  timeout = 5000,
}: ApiCallParams): Promise<any> => {
  try {
    const response = await axios({
      method,
      url,
      data,
      params,
      headers,
      timeout,
    });
    return response.data;
  } catch (error) {
    // console.error("API call error:", error);
    throw error;
  }
};
