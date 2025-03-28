import type { GraphQLSchema } from 'graphql';
import { existsSync, promises } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defaultConfig, type GQtyConfig } from './config';
import { generate, type TransformSchemaOptions } from './generate';

export type OnExistingFileConflict =
  | ((existingFile: string) => void | Promise<void>)
  | undefined;

async function writeClientCode({
  destinationPath,
  clientCode,
  onExistingFileConflict,
}: {
  clientCode: string;
  destinationPath: string;
  onExistingFileConflict: OnExistingFileConflict;
}): Promise<void> {
  if (existsSync(destinationPath)) {
    if (onExistingFileConflict) {
      let existingFile = await promises.readFile(destinationPath, {
        encoding: 'utf-8',
      });
      await onExistingFileConflict(existingFile);
    }
    return;
  }

  await promises.writeFile(destinationPath, clientCode, {
    encoding: 'utf-8',
  });
}

function waitFunctions(...fns: Array<() => Promise<unknown>>) {
  return Promise.all(fns.map((fn) => fn()));
}

async function writeSchemaCode({
  schemaCode,
  destinationPath,
  isJavascriptOutput,
  javascriptSchemaCode,
}: {
  schemaCode: string;
  destinationPath: string;
  isJavascriptOutput: boolean;
  javascriptSchemaCode: string;
}): Promise<void> {
  await waitFunctions(
    async () => {
      let schemaPath = resolve(
        dirname(destinationPath),
        isJavascriptOutput ? './schema.generated.d.ts' : './schema.generated.ts'
      );

      if (existsSync(schemaPath)) {
        let existingCode = await promises.readFile(schemaPath, {
          encoding: 'utf-8',
        });

        if (existingCode === schemaCode) return;
      }

      await promises.writeFile(schemaPath, schemaCode, {
        encoding: 'utf-8',
      });
    },
    async () => {
      if (isJavascriptOutput) {
        let schemaPath = resolve(
          dirname(destinationPath),
          './schema.generated.js'
        );

        if (existsSync(schemaPath)) {
          let existingCode = await promises.readFile(schemaPath, {
            encoding: 'utf-8',
          });

          if (existingCode === javascriptSchemaCode) return;
        }

        await promises.writeFile(schemaPath, javascriptSchemaCode, {
          encoding: 'utf-8',
        });
      }
    }
  );
}

export async function writeGenerate(
  schema: GraphQLSchema,
  destinationPath: string,
  configuration: GQtyConfig,
  onExistingFileConflict?: OnExistingFileConflict,
  transformsGenerate?: TransformSchemaOptions
) {
  let isJavascriptOutput =
    configuration.javascriptOutput ?? defaultConfig.javascriptOutput;

  if (isJavascriptOutput) {
    if (!destinationPath.endsWith('.js')) {
      let err = Error(
        'You have to specify the ".js" extension, instead, it received: "' +
          destinationPath +
          '"'
      );

      Error.captureStackTrace(err, writeGenerate);

      throw err;
    }
  } else if (!destinationPath.endsWith('.ts')) {
    let err = Error(
      'You have to specify the ".ts" extension, instead, it received: "' +
        destinationPath +
        '"'
    );

    Error.captureStackTrace(err, writeGenerate);

    throw err;
  }

  destinationPath = resolve(destinationPath);

  let [{ clientCode, schemaCode, javascriptSchemaCode }] = await Promise.all([
    generate(schema, configuration, transformsGenerate),
    promises.mkdir(dirname(destinationPath), { recursive: true }),
  ]);

  await Promise.all([
    writeClientCode({ clientCode, destinationPath, onExistingFileConflict }),
    writeSchemaCode({
      schemaCode,
      destinationPath,
      isJavascriptOutput,
      javascriptSchemaCode,
    }),
  ]);

  return destinationPath;
}
