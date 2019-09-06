// Type definitions for koa2-router
// Project: https://github.com/xinpianchang/koa2-router
// Definitions by: Tang Ye <https://github.com/tangye1234>
// TypeScript Version: 2.3

/* =================== USAGE ===================
import Router from "koa2-router";
import * as Koa from "koa";
const app = new Koa();

app.use(new Router());
=============================================== */

import { Middleware, ParameterizedContext } from "koa"
import { Path } from "path-to-regexp"

declare module "koa" {
  interface BaseContext extends RouterContextInit {}
  interface BaseRequest extends RouterRequestInit {}
  interface BaseResponse extends RouterResponseInit {}
}

export interface RouterRequestInit {
  readonly params: Record<string | number, any>;
  readonly baseUrl: string;
  readonly matched: string[];
}

export interface RouterResponseInit {
  readonly responded?: boolean;
}

export interface RouterContextInit extends RouterRequestInit, RouterResponseInit {}

declare namespace KoaRouter {

  export interface RouteType {
    new <StateT = any, CustomT = {}>(path: string): Route<StateT, CustomT>;
  }

  export interface Route<StateT = any, CustomT = {}> {
    readonly path: Path;
    all: (...middlewares: Middleware<StateT, CustomT>[]) => Route<StateT, CustomT>;
    head: (...middlewares: Middleware<StateT, CustomT>[]) => Route<StateT, CustomT>;
    get: (...middlewares: Middleware<StateT, CustomT>[]) => Route<StateT, CustomT>;
    post: (...middlewares: Middleware<StateT, CustomT>[]) => Route<StateT, CustomT>;
    delete: (...middlewares: Middleware<StateT, CustomT>[]) => Route<StateT, CustomT>;
    del: (...middlewares: Middleware<StateT, CustomT>[]) => Route<StateT, CustomT>;
    put: (...middlewares: Middleware<StateT, CustomT>[]) => Route<StateT, CustomT>;
    patch: (...middlewares: Middleware<StateT, CustomT>[]) => Route<StateT, CustomT>;
    options: (...middlewares: Middleware<StateT, CustomT>[]) => Route<StateT, CustomT>;
  }

  export type Options = string | {
    name?: string;
    caseSensitive?: boolean;
    strict?: boolean;
    mergeParams?: <C extends object = any, P extends object = any>(currentParams: C, parentParams: P) => Record<string | number, any>
  }

  export type Context<StateT = any, CustomT = {}> = ParameterizedContext<StateT, CustomT> & RouterContextInit

  export type ParamCallback<K = string | number, V = any, StateT = any, CustomT = {}> = (
    context: Context<StateT, CustomT>,
    next: () => Promise<any>,
    value: V,
    name: K, 
  ) => any;

  export interface AllowOptions<StateT = any, CustomT = {}> {
    throw?: boolean;
    methodNotAllowed?: (ctx: Context<StateT, CustomT>, methods: string[]) => any;
    notImplemented?: (ctx: Context<StateT, CustomT>) => any;
  }

  export interface Router<StateT = any, CustomT = {}> extends Middleware<StateT, CustomT> {
    _name: string;
    route(path: Path): Route<StateT, CustomT>;
    param: <K extends string | number, V = any>(name: K, fn: ParamCallback<K, V, StateT, CustomT>) => Router<StateT, CustomT>;
    use: (pathOrMiddleware: Path | Middleware<StateT, CustomT>, ...middlewares: Middleware<StateT, CustomT>[]) => Router<StateT, CustomT>;
    all: (pathOrMiddleware: Path | Middleware<StateT, CustomT>, ...middlewares: Middleware<StateT, CustomT>[]) => Router<StateT, CustomT>;
    head: (pathOrMiddleware: Path | Middleware<StateT, CustomT>, ...middlewares: Middleware<StateT, CustomT>[]) => Router<StateT, CustomT>;
    get: (pathOrMiddleware: Path | Middleware<StateT, CustomT>, ...middlewares: Middleware<StateT, CustomT>[]) => Router<StateT, CustomT>;
    post: (pathOrMiddleware: Path | Middleware<StateT, CustomT>, ...middlewares: Middleware<StateT, CustomT>[]) => Router<StateT, CustomT>;
    delete: (pathOrMiddleware: Path | Middleware<StateT, CustomT>, ...middlewares: Middleware<StateT, CustomT>[]) => Router<StateT, CustomT>;
    del: (pathOrMiddleware: Path | Middleware<StateT, CustomT>, ...middlewares: Middleware<StateT, CustomT>[]) => Router<StateT, CustomT>;
    put: (pathOrMiddleware: Path | Middleware<StateT, CustomT>, ...middlewares: Middleware<StateT, CustomT>[]) => Router<StateT, CustomT>;
    patch: (pathOrMiddleware: Path | Middleware<StateT, CustomT>, ...middlewares: Middleware<StateT, CustomT>[]) => Router<StateT, CustomT>;
    options: (pathOrMiddleware: Path | Middleware<StateT, CustomT>, ...middlewares: Middleware<StateT, CustomT>[]) => Router<StateT, CustomT>;
    allowMethods: (options?: AllowOptions<StateT, CustomT>) => Middleware<StateT, CustomT>;
  }

  interface RouterType {
    new <StateT = any, CustomT = {}>(options?: Options): Router<StateT, CustomT>;
    <StateT = any, CustomT = {}>(options?: Options): Router<StateT, CustomT>;
    Route: RouteType;
  }
}

export type KoaRouterType = KoaRouter.RouterType

declare const Router: KoaRouterType
export default Router
