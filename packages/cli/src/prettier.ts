import * as deps from './deps';

let { format: prettierFormat, resolveConfig } = deps.prettier;
let commonConfig = resolveConfig(process.cwd());

export function formatPrettier(
  defaultOptions: Omit<deps.PrettierOptions, 'parser'> &
    Required<Pick<deps.PrettierOptions, 'parser'>>
) {
  let configPromise = commonConfig.then((config) =>
    Object.assign({}, config, defaultOptions)
  );

  return {
    async format(input: string) {
      return prettierFormat(input, await configPromise);
    },
  };
}
