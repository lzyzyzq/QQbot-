import axios, { AxiosResponse } from 'axios'

const instance = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.hash = '#/login'
    }
    return Promise.reject(error)
  }
)

export const api = {
  get: <T = any>(url: string, config?: any): Promise<T> => instance.get(url, config),
  post: <T = any>(url: string, data?: any, config?: any): Promise<T> => instance.post(url, data, config),
  put: <T = any>(url: string, data?: any, config?: any): Promise<T> => instance.put(url, data, config),
  delete: <T = any>(url: string, config?: any): Promise<T> => instance.delete(url, config),
}
