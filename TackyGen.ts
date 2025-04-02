import * as Ast from "./Ast.ts";
import { Symbol } from "./Symbols.ts";
import * as Tacky from "./Tacky.ts";
import { UniqueId } from "./UniqueId.ts";

export class TackyGen {
    generate(progam: Ast.Program, symbolTable: Map<string, Symbol>): Tacky.Program {
        const fnDefs: Tacky.TopLevelConstruct[] = progam.funDecls
            .filter(d => d.tag === "fundecl" && d.body)
            .map(fn => this.emitFunDeclaration(fn as Ast.FunDecl, symbolTable));
        const varDefs: Tacky.TopLevelConstruct[] = this.convertSymbolsToTacky(symbolTable);
        return { topLevelConstructs: varDefs.concat(fnDefs) };
    }

    private emitFunDeclaration(fn: Ast.FunDecl, symbolTable: Map<string, Symbol>): Tacky.Function {
        const body: Tacky.Instruction[] = [];
        fn.body!.blockItems.forEach(e => this.emitTackyForBlockItem(e, body));
        body.push({ tag: "return", value: { tag: "constant", value: 0 } });
        return {
            tag: "function",
            name: fn.name,
            global: this.isFunctionGlobal(fn, symbolTable),
            params: fn.params,
            body
        };
    }

    private isFunctionGlobal(fn: Ast.FunDecl, symbolTable: Map<string, Symbol>): boolean {
        const symbol: Symbol = symbolTable.get(fn.name)!;
        switch (symbol.attrs?.tag) {
            case "funattr": return symbol.attrs.global;
            case "staticattr": return symbol.attrs.global;
        }
        return false;
    }

    private emitTackyForBlockItem(blockItem: Ast.BlockItem, instructions: Tacky.Instruction[]): void {
        switch (blockItem.tag) {
            case "return":
            case "expression":
            case "if":
            case "compound":
            case "break":
            case "continue":
            case "while":
            case "dowhile":
            case "for":
            case "null":
                this.emitTackyForStatement(blockItem, instructions);
                break;
            case "fundecl":
            case "vardecl":
                this.emitLocalDeclaration(blockItem, instructions);
                break;
            default: throw new Error("Unknown block item.");
        };
    }

    private emitLocalDeclaration(decl: Ast.Declaration, instructions: Tacky.Instruction[]): void {
        switch (decl.tag) {
            case "vardecl": {
                if (decl.storageClass) return;
                this.emitVarDeclaration(decl, instructions);
            }
        }
    }

    private emitVarDeclaration(decl: Ast.VarDecl, instructions: Tacky.Instruction[]): void {
        if (decl.init) {
            const result = this.emitTackyForExp(decl.init, instructions);
            instructions.push({ tag: "copy", src: result, dst: { tag: "var", value: decl.name } });
        }
    }

    private emitTackyForExp(exp: Ast.Exp, instructions: Tacky.Instruction[]): Tacky.Val {
        switch (exp.tag) {
            case "constant": return { tag: "constant", value: exp.value };
            case "var": return { tag: "var", value: exp.identifier };
            case "unary": return this.emitUnaryExp(exp, instructions);
            case "binary": {
                switch (exp.operator) {
                    case "And": return this.emitAndExp(exp, instructions);
                    case "Or": return this.emitOrExp(exp, instructions);
                    default: return this.emitBinaryExp(exp, instructions);
                }
            }
            case "assignment": return this.emitAssignment(exp.left, exp.right, instructions);
            case "conditional": return this.emitConditionalExp(exp, instructions);
            case "functioncall": return this.emitFnCall(exp, instructions);
        }
    }

    private emitUnaryExp(exp: Ast.Unary, instructions: Tacky.Instruction[]): Tacky.Val {
        const src = this.emitTackyForExp(exp.expression, instructions);
        const dstName = UniqueId.makeTemporary();
        const dst: Tacky.Var = { tag: "var", value: dstName };
        const op = this.convertOp(exp.operator);

        instructions.push({ tag: "unary", op, src, dst });

        return dst;
    }

    private convertOp(type: Ast.UnaryOp): Tacky.UnaryOp {
        return type as Tacky.UnaryOp;
    }

    private emitAndExp(exp: Ast.Binary, instructions: Tacky.Instruction[]): Tacky.Val {
        const falseLabel = UniqueId.makeLabel("and_false");
        const endLabel = UniqueId.makeLabel("and_end");
        const dstName = UniqueId.makeTemporary();
        const dst: Tacky.Var = { tag: "var", value: dstName };

        const left = this.emitTackyForExp(exp.left, instructions);
        instructions.push({ tag: "jumpifzero", condition: left, target: falseLabel });
        const right = this.emitTackyForExp(exp.right, instructions);
        instructions.push(
            { tag: "jumpifzero", condition: right, target: falseLabel },
            { tag: "copy", src: { tag: "constant", value: 1 }, dst },
            { tag: "jump", target: endLabel },
            { tag: "label", value: falseLabel },
            { tag: "copy", src: { tag: "constant", value: 0 }, dst },
            { tag: "label", value: endLabel },
        );
        return dst;
    }

    private emitOrExp(exp: Ast.Binary, instructions: Tacky.Instruction[]): Tacky.Val {
        const trueLabel = UniqueId.makeLabel("or_true");
        const endLabel = UniqueId.makeLabel("or_end");
        const dstName = UniqueId.makeTemporary();
        const dst: Tacky.Var = { tag: "var", value: dstName };

        const left = this.emitTackyForExp(exp.left, instructions);
        instructions.push({ tag: "jumpifnotzero", condition: left, target: trueLabel });
        const right = this.emitTackyForExp(exp.right, instructions);
        instructions.push(
            { tag: "jumpifnotzero", condition: right, target: trueLabel },
            { tag: "copy", src: { tag: "constant", value: 0 }, dst },
            { tag: "jump", target: endLabel },
            { tag: "label", value: trueLabel },
            { tag: "copy", src: { tag: "constant", value: 1 }, dst },
            { tag: "label", value: endLabel },
        );
        return dst;
    }

    private emitBinaryExp(exp: Ast.Binary, instructions: Tacky.Instruction[]): Tacky.Val {
        const src1 = this.emitTackyForExp(exp.left, instructions);
        const src2 = this.emitTackyForExp(exp.right, instructions);
        const dstName = UniqueId.makeTemporary();
        const dst: Tacky.Var = { tag: "var", value: dstName };
        const op = this.convertBinaryOp(exp.operator);

        instructions.push({ tag: "binary", op, src1, src2, dst });

        return dst;
    }

    private convertBinaryOp(type: Ast.BinaryOp): Tacky.BinaryOp {
        return type as Tacky.BinaryOp;
    }

    private emitAssignment(lhs: Ast.Exp, rhs: Ast.Exp, instructions: Tacky.Instruction[]): Tacky.Val {
        const result = this.emitTackyForExp(rhs, instructions);
        instructions.push({ tag: "copy", src: result, dst: { tag: "var", value: (lhs as Ast.Var).identifier } });
        return { tag: "var", value: (lhs as Ast.Var).identifier };
    }

    private emitConditionalExp(exp: Ast.Conditional, instructions: Tacky.Instruction[]): Tacky.Val {
        const condition = this.emitTackyForExp(exp.condition, instructions);
        const elseClauseLabel = UniqueId.makeLabel("conditional_else");
        instructions.push({ tag: "jumpifzero", condition: condition, target: elseClauseLabel });

        const thenClause = this.emitTackyForExp(exp.then, instructions);

        const dstName = UniqueId.makeTemporary();
        const dst: Tacky.Var = { tag: "var", value: dstName };
        instructions.push({ tag: "copy", src: thenClause, dst });

        const endLabel = UniqueId.makeLabel("conditional_end");
        instructions.push({ tag: "jump", target: endLabel });
        instructions.push({ tag: "label", value: elseClauseLabel });

        const elseClause = this.emitTackyForExp(exp.else, instructions);
        instructions.push({ tag: "copy", src: elseClause, dst });
        instructions.push({ tag: "label", value: endLabel });

        return dst;
    }

    private emitFnCall(fnCall: Ast.FunctionCall, instructions: Tacky.Instruction[]): Tacky.Val {
        const argVals = fnCall.args.map(e => this.emitTackyForExp(e, instructions));

        const dstName = UniqueId.makeTemporary();
        const dst: Tacky.Var = { tag: "var", value: dstName };
        instructions.push({ tag: "fncall", name: fnCall.name, args: argVals, dst });

        return dst;
    }

    private emitTackyForStatement(stmt: Ast.Statement, instructions: Tacky.Instruction[]): void {
        switch (stmt.tag) {
            case "return": {
                const result = this.emitTackyForExp(stmt.expression, instructions);
                instructions.push({ tag: "return", value: result });
                break;
            }
            case "expression":
                this.emitTackyForExp(stmt.expression, instructions);
                break;
            case "if":
                this.emitTackyForIfStatement(stmt, instructions);
                break;
            case "compound":
                stmt.block.blockItems.forEach(e => this.emitTackyForBlockItem(e, instructions));
                break;
            case "break":
                instructions.push({ tag: "jump", target: this.breakLabel(stmt.identifier) });
                break;
            case "continue":
                instructions.push({ tag: "jump", target: this.continueLabel(stmt.identifier) });
                break;
            case "while":
                this.emitTackyForWhileLoop(stmt, instructions);
                break;
            case "dowhile":
                this.emitTackyForDoWhileLoop(stmt, instructions);
                break;
            case "for":
                this.emitTackyForForLoop(stmt, instructions);
                break;
        }
    }

    private emitTackyForIfStatement(stmt: Ast.If, instructions: Tacky.Instruction[]): void {
        if (stmt.else === undefined) {
            const condition = this.emitTackyForExp(stmt.condition, instructions);
            const endLabel = UniqueId.makeLabel("if_end");
            instructions.push({ tag: "jumpifzero", condition, target: endLabel });

            this.emitTackyForStatement(stmt.then, instructions);

            instructions.push({ tag: "label", value: endLabel });
        } else {
            const condition = this.emitTackyForExp(stmt.condition, instructions);

            const elseLabel = UniqueId.makeLabel("else");
            instructions.push({ tag: "jumpifzero", condition, target: elseLabel });

            this.emitTackyForStatement(stmt.then, instructions);

            const endLabel = UniqueId.makeLabel("");
            instructions.push({ tag: "jump", target: endLabel });
            instructions.push({ tag: "label", value: elseLabel });

            this.emitTackyForStatement(stmt.else, instructions);

            instructions.push({ tag: "label", value: endLabel });
        }
    }

    private breakLabel(id: string): string {
        return `break.${id}`;
    }

    private continueLabel(id: string): string {
        return `continue.${id}`;
    }

    private emitTackyForWhileLoop(stmt: Ast.While, instructions: Tacky.Instruction[]): void {
        const continueLabel = this.continueLabel(stmt.identifier);
        const breakLabel = this.breakLabel(stmt.identifier);

        instructions.push({ tag: "label", value: continueLabel });
        const result = this.emitTackyForExp(stmt.condition, instructions);
        instructions.push({ tag: "jumpifzero", condition: result, target: breakLabel });
        this.emitTackyForStatement(stmt.body, instructions);
        instructions.push(
            { tag: "jump", target: continueLabel },
            { tag: "label", value: breakLabel }
        );
    }

    private emitTackyForDoWhileLoop(stmt: Ast.DoWhile, instructions: Tacky.Instruction[]): void {
        const startLabel = UniqueId.makeLabel("do_loop_start");
        const continueLabel = this.continueLabel(stmt.identifier);
        const breakLabel = this.breakLabel(stmt.identifier);

        instructions.push({ tag: "label", value: startLabel });
        this.emitTackyForStatement(stmt.body, instructions);
        instructions.push({ tag: "label", value: continueLabel });
        const result = this.emitTackyForExp(stmt.condition, instructions);
        instructions.push({ tag: "jumpifnotzero", condition: result, target: startLabel });
        instructions.push({ tag: "label", value: breakLabel });
    }

    private emitTackyForForLoop(stmt: Ast.For, instructions: Tacky.Instruction[]): void {
        const startLabel = UniqueId.makeLabel("for_start");
        const continueLabel = this.continueLabel(stmt.identifier);
        const breakLabel = this.breakLabel(stmt.identifier);

        switch (stmt.forInit.tag) {
            case "initdecl":
                this.emitVarDeclaration(stmt.forInit.declaration, instructions);
                break;
            case "initexp":
                if (stmt.forInit.exp) {
                    this.emitTackyForExp(stmt.forInit.exp, instructions);
                }
        }
        instructions.push({ tag: "label", value: startLabel });
        if (stmt.condition) {
            const result = this.emitTackyForExp(stmt.condition, instructions);
            instructions.push({ tag: "jumpifzero", condition: result, target: breakLabel });
        }
        this.emitTackyForStatement(stmt.body, instructions);
        instructions.push({ tag: "label", value: continueLabel });
        if (stmt.post) {
            this.emitTackyForExp(stmt.post, instructions);
        }
        instructions.push(
            { tag: "jump", target: startLabel },
            { tag: "label", value: breakLabel }
        );
    }

    private convertSymbolsToTacky(symbolTable: Map<string, Symbol>): Tacky.StaticVariable[] {
        const valDefs: Tacky.StaticVariable[] = [];
        symbolTable.forEach((val, key) => {
            switch (val.attrs?.tag) {
                case "funattr":
                case "localattr": break;
                case "staticattr": {
                    switch (val.attrs.init.tag) {
                        case "tentative":
                            valDefs.push({
                                tag: "staticvariable",
                                global: val.attrs.global,
                                identifier: key,
                                init: 0
                            });
                            break;
                        case "initial":
                            valDefs.push({
                                tag: "staticvariable",
                                global: val.attrs.global,
                                identifier: key,
                                init: val.attrs.init.value
                            });
                        break;
                    }
                }
            }
        });
        return valDefs;
    }
};
