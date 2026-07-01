import { request as httpRequest } from './httpClient';

function resolveRawOptions(options = {}) {
  if (typeof options === 'boolean') {
    return {
      silent: options,
      redirectOnUnauthorized: false,
    };
  }
  return options;
}

const request = (method = 'GET', url = '', data = {}, options = {}) => (
  httpRequest(method, url, data, {
    auth: true,
    silent: true,
    redirectOnUnauthorized: false,
    ...resolveRawOptions(options),
  })
);

function get(url, data = null, options = {}) {
  return request('GET', url, data, options);
}

function post(url, data, options = {}) {
  return request('POST', url, data, options);
}

function put(url, data, options = {}) {
  return request('PUT', url, data, options);
}

function del(url, data = null, options = {}) {
  return request('DELETE', url, data, options);
}

export default {
  get, post, put, del,
};
