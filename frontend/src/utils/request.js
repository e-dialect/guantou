import { request as httpRequest } from './httpClient';

const request = (
  method = 'GET',
  url = '',
  data = {},
  noPrompt = false,
  options = {},
) => (
  httpRequest(method, url, data, {
    auth: true,
    silent: noPrompt,
    redirectOnUnauthorized: !noPrompt,
    ...options,
  })
);

function get(url, data = null, noPrompt = false, options = {}) {
  return request('GET', url, data, noPrompt, options);
}

function post(url, data = {}, noPrompt = false, options = {}) {
  return request('POST', url, data, noPrompt, options);
}

function patch(url, data = {}, noPrompt = false, options = {}) {
  return request('PATCH', url, data, noPrompt, options);
}

function put(url, data = {}, noPrompt = false, options = {}) {
  return request('PUT', url, data, noPrompt, options);
}

function del(url, data = null, noPrompt = false, options = {}) {
  return request('DELETE', url, data, noPrompt, options);
}

export default {
  get, post, patch, put, del,
};
