import axios from "axios";
axios.defaults.withCredentials = true;
export const apiCall = async ({ method, url, data = {}, params = {}, headers, timeout = 10000,
// withCredentials = false
 }) => {
    try {
        const response = await axios({
            method,
            url,
            data,
            params,
            headers,
            // withCredentials
            // timeout,
        });
        return response.data;
    }
    catch (error) {
        // console.error("API call error:", error?.response?.data || error?.message);
        throw error;
    }
};
export const post = async (url, body) => {
    const requestOptions = {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: body
    };
    return await fetch(url, requestOptions);
};
//# sourceMappingURL=axios.js.map