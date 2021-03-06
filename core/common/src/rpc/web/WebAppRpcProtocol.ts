/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { Readable, Writable } from "stream";
import { RpcConfiguration } from "../core/RpcConfiguration";
import { RpcContentType, RpcRequestStatus, WEB_RPC_CONSTANTS } from "../core/RpcConstants";
import { RpcOperation } from "../core/RpcOperation";
import { RpcProtocol } from "../core/RpcProtocol";
import { OpenAPIInfo, OpenAPIParameter, RpcOpenAPIDescription } from "./OpenAPI";
import { WebAppRpcLogging } from "./WebAppRpcLogging";
import { WebAppRpcRequest } from "./WebAppRpcRequest";

/** An HTTP server request object.
 * @public
 */
export interface HttpServerRequest extends Readable {
  httpVersion: string;
  httpVersionMajor: number;
  httpVersionMinor: number;
  connection: any;
  headers: { [header: string]: string | string[] | undefined };
  rawHeaders: string[];
  trailers: { [key: string]: string | undefined };
  rawTrailers: string[];
  setTimeout(msecs: number, callback: () => void): this;
  url?: string;
  statusCode?: number;
  statusMessage?: string;
  socket: any;
  destroy(error?: Error): void;
  body: string | Buffer;
  path: string;
  method: string;
  ip?: string;
  header: (field: string) => string | undefined;
}

/** An HTTP server response object.
 * @public
 */
export interface HttpServerResponse extends Writable {
  send(body?: any): HttpServerResponse;
  status(code: number): HttpServerResponse;
  set(field: string, value: string): void;
}

/** The HTTP application protocol.
 * @public
 */
export abstract class WebAppRpcProtocol extends RpcProtocol {
  public preserveStreams = true;

  /** Convenience handler for an RPC operation get request for an HTTP server. */
  public async handleOperationGetRequest(req: HttpServerRequest, res: HttpServerResponse) {
    return this.handleOperationPostRequest(req, res);
  }

  /** Convenience handler for an RPC operation post request for an HTTP server. */
  public async handleOperationPostRequest(req: HttpServerRequest, res: HttpServerResponse) {
    const request = await WebAppRpcRequest.parseRequest(this, req);
    const fulfillment = await this.fulfill(request);
    WebAppRpcRequest.sendResponse(this, request, fulfillment, res);
  }

  /** Convenience handler for an OpenAPI description request for an HTTP server. */
  public handleOpenApiDescriptionRequest(_req: HttpServerRequest, res: HttpServerResponse) {
    const description = JSON.stringify(this.openAPIDescription);
    res.send(description);
  }

  /** Converts an HTTP content type value to an RPC content type value. */
  public static computeContentType(httpType: string | null | undefined): RpcContentType {
    if (!httpType)
      return RpcContentType.Unknown;

    if (httpType.indexOf(WEB_RPC_CONSTANTS.ANY_TEXT) === 0) {
      return RpcContentType.Text;
    } else if (httpType.indexOf(WEB_RPC_CONSTANTS.BINARY) === 0) {
      return RpcContentType.Binary;
    } else if (httpType.indexOf(WEB_RPC_CONSTANTS.MULTIPART) === 0) {
      return RpcContentType.Multipart;
    } else {
      return RpcContentType.Unknown;
    }
  }

  /** The OpenAPI-compatible info object for this protocol. */
  public abstract info: OpenAPIInfo;

  /** An optional prefix for RPC operation URI paths. */
  public pathPrefix: string = "";

  /** The RPC request class for this protocol. */
  public readonly requestType = WebAppRpcRequest;

  /** Supplies the status corresponding to a protocol-specific code value. */
  public getStatus(code: number): RpcRequestStatus {
    switch (code) {
      case 404: return RpcRequestStatus.NotFound;
      case 202: return RpcRequestStatus.Pending;
      case 200: return RpcRequestStatus.Resolved;
      case 500: return RpcRequestStatus.Rejected;
      default: return RpcRequestStatus.Unknown;
    }
  }

  /** Supplies the protocol-specific code corresponding to a status value. */
  public getCode(status: RpcRequestStatus): number {
    switch (status) {
      case RpcRequestStatus.NotFound: return 404;
      case RpcRequestStatus.Pending: return 202;
      case RpcRequestStatus.Resolved: return 200;
      case RpcRequestStatus.Rejected: return 500;
      default: return 501;
    }
  }

  /** Whether an HTTP status code indicates a request timeout. */
  public isTimeout(code: number): boolean {
    return code === 504;
  }

  /** An OpenAPI-compatible description of this protocol.
   * @internal
   */
  public get openAPIDescription() { return new RpcOpenAPIDescription(this); }

  /** Returns the OpenAPI-compatible URI path parameters for an RPC operation.
   * @internal
   */
  public abstract supplyPathParametersForOperation(_operation: RpcOperation): OpenAPIParameter[];

  /** Constructs an HTTP protocol. */
  public constructor(configuration: RpcConfiguration) {
    super(configuration);
    this.events.addListener(WebAppRpcLogging.logProtocolEvent);
  }
}
