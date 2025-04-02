import * as Assembly from "./Assembly.ts";

export class InstructionFixup {

    fixupProgram(progam: Assembly.Program): Assembly.Program {
        return {
            topLevelConstructs: progam.topLevelConstructs.map(c => this.fixupTopLevelConstruct(c))
        };
    }

    private fixupTopLevelConstruct(construct: Assembly.TopLevelConstruct): Assembly.TopLevelConstruct {
        switch (construct.tag) {
            case "function": return this.fixupFunction(construct);
            case "staticvariable": return construct;
        }
    }

    private fixupFunction(fn: Assembly.Function): Assembly.Function {
        const instructions: Assembly.Instruction[] = [];

        const stackOffset = fn.stackOffset + 16 - fn.stackOffset % 16;
        instructions.push({ tag: "allocatestack", value: stackOffset.toString() });

        fn.instructions.forEach(instruction => {
            switch (instruction.tag) {
                case "mov": {
                    if (instruction.src.tag === "stack" && instruction.dst.tag === "stack" || instruction.src.tag === "data" && instruction.dst.tag === "stack"
                    ) {
                        instructions.push(
                            { tag: "mov", src: instruction.src, dst: { tag: "reg", value: "R10" } },
                            { tag: "mov", src: { tag: "reg", value: "R10" }, dst: instruction.dst }
                        );
                        break;
                    }
                    if (instruction.src.tag === "stack" && instruction.dst.tag === "data" || instruction.src.tag === "data" && instruction.dst.tag === "data") {
                        instructions.push(
                            { tag: "mov", src: instruction.src, dst: { tag: "reg", value: "R10" } },
                            { tag: "mov", src: { tag: "reg", value: "R10" }, dst: { tag: "data", identifier: instruction.dst.identifier } }
                        );
                        break;
                    }
                    instructions.push(instruction);
                    break;
                }
                case "idiv": {
                    if (instruction.operand.tag === "imm") {
                        instructions.push(
                            { tag: "mov", src: instruction.operand, dst: { tag: "reg", value: "R10" } },
                            { tag: "idiv", operand: { tag: "reg", value: "R10" } }
                        );
                        break;
                    }
                    instructions.push(instruction);
                    break;
                }
                case "binary": {
                    switch (instruction.operator) {
                        case "Add":
                        case "Sub": {
                            if (instruction.src.tag === "stack" && instruction.dst.tag === "stack" || instruction.src.tag === "data" && instruction.dst.tag === "stack"
                            ) {
                                instructions.push(
                                    { tag: "mov", src: instruction.src, dst: { tag: "reg", value: "R10" } },
                                    { tag: "binary", operator: instruction.operator, src: { tag: "reg", value: "R10" }, dst: instruction.dst }
                                );
                                break;
                            }
                            if (instruction.src.tag === "stack" && instruction.dst.tag === "data" || instruction.src.tag === "data" && instruction.dst.tag === "data") {
                                instructions.push(
                                    { tag: "mov", src: instruction.src, dst: { tag: "reg", value: "R10" } },
                                    { tag: "binary", operator: instruction.operator, src: { tag: "reg", value: "R10" }, dst: { tag: "data", identifier: instruction.dst.identifier } }
                                );
                                break;
                            }
                            instructions.push(instruction);
                            break;
                        }
                        case "Mult": {
                            instructions.push(
                                { tag: "mov", src: instruction.dst, dst: { tag: "reg", value: "R11" } },
                                { tag: "binary", operator: instruction.operator, src: instruction.src, dst: { tag: "reg", value: "R11" } },
                                { tag: "mov", src: { tag: "reg", value: "R11" }, dst: instruction.dst },
                            );
                            break;
                        }
                    }
                    break;
                }
                case "cmp": {
                    if (instruction.operand1.tag === "stack" && instruction.operand2.tag === "stack" || instruction.operand1.tag === "data" && instruction.operand2.tag === "stack"
                    ) {
                        instructions.push(
                            { tag: "mov", src: instruction.operand1, dst: { tag: "reg", value: "R10" } },
                            { tag: "cmp", operand1: { tag: "reg", value: "R10" }, operand2: instruction.operand2 }
                        );
                        break;
                    }
                    if (instruction.operand1.tag === "stack" && instruction.operand2.tag === "data" || instruction.operand1.tag === "data" && instruction.operand2.tag === "data") {
                        instructions.push(
                            { tag: "mov", src: instruction.operand1, dst: { tag: "reg", value: "R10" } },
                            { tag: "cmp", operand1: { tag: "reg", value: "R10" }, operand2: { tag: "data", identifier: instruction.operand2.identifier } }
                        );
                        break;
                    }
                    if (instruction.operand2.tag === "imm") {
                        instructions.push(
                            { tag: "mov", src: instruction.operand2, dst: { tag: "reg", value: "R11" } },
                            { tag: "cmp", operand1: instruction.operand1, operand2: { tag: "reg", value: "R11" } }
                        );
                        break;
                    }
                    instructions.push(instruction);
                    break;
                }
                default: instructions.push(instruction);
            }
        });

        return {
            tag: "function",
            name: fn.name,
            global: fn.global,
            instructions: instructions,
            stackOffset: fn.stackOffset
        };
    }
};
