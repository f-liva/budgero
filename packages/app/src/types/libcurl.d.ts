// Minimal typings for libcurl.js (https://github.com/ading2210/libcurl.js),
// covering only what bank sync uses.
declare module 'libcurl.js' {
  export interface LibcurlFetchInit extends RequestInit {
    _libcurl_verbose?: number;
    _libcurl_http_version?: number;
  }

  export interface Libcurl {
    readonly ready: boolean;
    load_wasm(url?: string): Promise<void>;
    /** Must end with a trailing slash. Existing connections stay open. */
    set_websocket(url: string): void;
    fetch(url: string, init?: LibcurlFetchInit): Promise<Response>;
    get_error_string(code: number): string;
    logger: (type: 'log' | 'warn' | 'error', text: string) => void;
    stderr: (text: string) => void;
  }

  export const libcurl: Libcurl;
}

declare module 'libcurl.js/libcurl.wasm?url' {
  const url: string;
  export default url;
}
