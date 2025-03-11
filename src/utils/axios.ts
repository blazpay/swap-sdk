import axios, { AxiosRequestHeaders, Method } from "axios";

interface ApiCallParams {
  method: Method;
  url: string;
  data?: Record<string, any> | string;
  params?: Record<string, any>;
  headers?: any;
  timeout?: number;
  withCredentials?: boolean
}

axios.defaults.withCredentials = true;

export const apiCall = async ({
  method,
  url,
  data = {},
  params = {},
  headers,
  timeout = 10000,
  withCredentials = false
}: ApiCallParams): Promise<any> => {
  try {
    const response = await axios({
      method,
      url,
      data,
      params,
      headers,
      withCredentials
      // timeout,
    });
    return response.data;
  } catch (error: any) {
    // console.error("API call error:", error?.response?.data || error?.message);
    throw error;
  }
};

export const post = async(url: string, body: any) =>{
  const requestOptions: any = {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: body
  }

  return await fetch(url, requestOptions)
}