import axios, { AxiosRequestHeaders, Method } from "axios";

// Define the types for the function parameters and return value
interface ApiCallParams {
  method: Method;
  url: string;
  data?: Record<string, any>;
  params?: Record<string, any>;
  headers?: AxiosRequestHeaders;
}

export const apiCall = async ({
  method,
  url,
  data = {},
  params = {},
  headers,
}: ApiCallParams): Promise<any> => {
  try {
    const response = await axios({
      method,
      url,
      data,
      params,
      headers,
    });
    return response.data;
  } catch (error) {
    console.error("API call error:", error);
    throw error;
  }
};
