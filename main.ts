import { Scan } from "./Scan.ts";
import { Parse } from "./Parse.ts";
import { Resolve } from "./Resolve.ts";
import { LabelLoops } from "./LabelLoops.ts";
import { TackyGen } from "./TackyGen.ts";
import { CodeGen } from "./CodeGen.ts";
import { ReplacePseudoes } from "./ReplacePseudos.ts";
import { InstructionFixup } from "./InstructionFixup.ts";
import { Emit } from "./Emit.ts";
import { TypeCheck } from "./TypeCheck.ts";
import { Symbol } from "./Symbols.ts";

if (import.meta.main) {
    // Deno.writeTextFileSync(`${Math.random()}.txt`, JSON.stringify(Deno.args, null, 4));

    // Compiler test suite passes the flag in first (if present) and then the
    // file path. If there is no flag then the first element is the filepath
    const inputFilePath = Deno.args.length == 1 ? Deno.args[0] : Deno.args[1];

    const preprocessorOutputFilePath = inputFilePath.replace(".c", ".i");

    await new Deno.Command("gcc", {
        args: [
            "-E",
            "-P",
            inputFilePath,
            "-o",
            preprocessorOutputFilePath,
        ],
    }).output();

    const source = await Deno.readTextFile(preprocessorOutputFilePath);

    let result;

    const scan = new Scan(source);
    result = scan.scanTokens();

    if (Deno.args[0] === "--lex") Deno.exit();

    const parse = new Parse();
    result = parse.parse(result);

    if (Deno.args[0] === "--parse") Deno.exit();

    const resolve = new Resolve();
    result = resolve.resolve(result);

    const labelLoops = new LabelLoops();
    result = labelLoops.labelLoops(result);

    const symbolTable = new Map<string, Symbol>();

    const typecheck = new TypeCheck();
    result = typecheck.typeCheck(result, symbolTable);

    if (Deno.args[0] === "--validate") Deno.exit();

    const tackyGen = new TackyGen();
    result = tackyGen.generate(result, symbolTable);

    if (Deno.args[0] === "--tacky") Deno.exit();

    const codeGen = new CodeGen();
    result = codeGen.generate(result);

    const replacePseudoes = new ReplacePseudoes();
    result = replacePseudoes.replacePseudoes(result, symbolTable);

    const instructionFixup = new InstructionFixup();
    result = instructionFixup.fixupProgram(result);

    if (Deno.args[0] === "--codegen") Deno.exit();

    const emit = new Emit();
    result = emit.emit(result);

    const assemblyFilePath = inputFilePath.replace(".c", ".s");
    await Deno.writeTextFile(assemblyFilePath, result.join(""));

    const objectFilePath = inputFilePath.replace(".c", ".o");
    await new Deno.Command("gcc", {
        args: [
            "-c",
            assemblyFilePath,
            "-o",
            objectFilePath,
        ],
    }).output();

    const binaryFilePath = inputFilePath.replace(".c", "");
    await new Deno.Command("gcc", {
        args: [
            objectFilePath,
            "-o",
            binaryFilePath,
        ],
    }).output();
}
