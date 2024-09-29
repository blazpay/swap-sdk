import axios, { AxiosRequestHeaders, Method } from "axios";

// Define the types for the function parameters and return value
interface ApiCallParams {
  method: Method;
  url: string;
  data?: Record<string, any>;
  params?: Record<string, any>;
  headers?: AxiosRequestHeaders;
  timeout?: number; // Optional timeout in milliseconds
}

export const apiCall = async ({
  method,
  url,
  data = {},
  params = {},
  headers,
  timeout = 5000, // Default timeout of 5 seconds
}: ApiCallParams): Promise<any> => {
  try {
    const response = await axios({
      method,
      url,
      data,
      params,
      headers,
      timeout, // Add the timeout property here
    });
    return response.data;
  } catch (error) {
    console.error("API call error:", error);
    throw error;
  }
};
