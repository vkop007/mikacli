declare const __MIKACLI_STANDALONE__: boolean | undefined;

export const IS_MIKACLI_STANDALONE =
  typeof __MIKACLI_STANDALONE__ !== "undefined" && __MIKACLI_STANDALONE__ === true;
