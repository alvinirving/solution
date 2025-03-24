import * as defaultCommand from './commands/default';
import * as generateCommand from './commands/generate';
import * as deps from './deps';
import { __innerState } from './innerState';

__innerState.isCLI = true;

declare let __VERSION__: string;

deps.program.version(__VERSION__);

generateCommand.addCommand(deps.program);
defaultCommand.addCommand(deps.program);

deps.program.parse(process.argv);
