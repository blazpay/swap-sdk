import axios from "axios";
export const apiCall = async ({ method, url, data = {}, params = {}, headers, timeout = 10000, }) => {
    try {
        const response = await axios({
            method,
            url,
            data,
            params,
            headers,
            // timeout,
        });
        return response.data;
    }
    catch (error) {
        // console.error("API call error:", error?.response?.data || error?.message);
        throw error;
    }
};
//# sourceMappingURL=axios.js.map