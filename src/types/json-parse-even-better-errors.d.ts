/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "json-parse-even-better-errors" {
  function parseJson(
    text: string,
    reviver?: (key: string, value: any) => any,
    context?: number
  ): any;

  namespace parseJson {
    function noExceptions(
      text: string,
      reviver?: (key: string, value: any) => any
    ): any | undefined;
  }

  export = parseJson;
}
