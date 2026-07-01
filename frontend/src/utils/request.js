import { request as httpRequest } from './httpClient';

const request = (method = 'GET', url = '', data = {}, noPrompt = false) => (
  httpRequest(method, url, data, {
    auth: true,
    silent: noPrompt,
    redirectOnUnauthorized: !noPrompt,
  })
);

function get(url, data = null, noPrompt = false) {
  return request('GET', url, data, noPrompt);
}

function post(url, data = {}, noPrompt = false) {
  return request('POST', url, data, noPrompt);
}

function put(url, data = {}, noPrompt = false) {
  return request('PUT', url, data, noPrompt);
}

function del(url, data = null, noPrompt = false) {
  return request('DELETE', url, data, noPrompt);
}

export default {
  get, post, put, del,
};
