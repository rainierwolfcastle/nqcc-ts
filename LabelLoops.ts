import * as Ast from "./Ast.ts";
import { UniqueId } from "./UniqueId.ts";

export class LabelLoops {

    private labelStatement(statement: Ast.Statement, currentLabel?: string): Ast.Statement {
        switch (statement.tag) {
            case "if":
                return {
                    tag: "if",
                    condition: statement.condition,
                    then: this.labelStatement(statement.then, currentLabel),
                    else: statement.else ? this.labelStatement(statement.else) : undefined
                };
            case "compound": {
                return {
                    tag: "compound",
                    block: this.labelBlock(statement.block, currentLabel)
                };
            }
            case "break": {
                if (currentLabel === undefined) throw new Error("Break outside of loop.");
                return {
                    tag: "break",
                    identifier: currentLabel
                };
            }
            case "continue": {
                if (currentLabel === undefined) throw new Error("Continue outside of loop.");
                return {
                    tag: "continue",
                    identifier: currentLabel
                };
            }
            case "while": {
                const newId = UniqueId.makeLabel("while");
                return {
                    tag: "while",
                    body: this.labelStatement(statement.body, newId),
                    condition: statement.condition,
                    identifier: newId
                };
            }
            case "dowhile": {
                const newId = UniqueId.makeLabel("dowhile");
                return {
                    tag: "dowhile",
                    body: this.labelStatement(statement.body, newId),
                    condition: statement.condition,
                    identifier: newId
                };
            }
            case "for": {
                const newId = UniqueId.makeLabel("for");
                return {
                    tag: "for",
                    body: this.labelStatement(statement.body, newId),
                    forInit: statement.forInit,
                    identifier: newId,
                    condition: statement.condition,
                    post: statement.post
                };
            }
            default: return statement;
        }
    }

    private labelBlockItem(blockItem: Ast.BlockItem, currentLabel?: string): Ast.BlockItem {
        switch (blockItem.tag) {
            case "vardecl":
            case "fundecl":
                return blockItem;
            default: return this.labelStatement(blockItem, currentLabel);
        }
    }

    private labelBlock(block: Ast.Block, currentLabel?: string): Ast.Block {
        return {
            tag: "block",
            blockItems: block.blockItems.map(e => this.labelBlockItem(e, currentLabel))
        };
    }

    private labelDeclaration(decl: Ast.Declaration): Ast.Declaration {
        switch(decl.tag) {
            case "fundecl":
                return {
                    tag: "fundecl",
                    name: decl.name,
                    params: decl.params,
                    body: decl.body ? this.labelBlock(decl.body) : undefined,
                    storageClass: decl.storageClass
                };
            case "vardecl":
                return decl;
        }
    }

    labelLoops(program: Ast.Program): Ast.Program {
        return { funDecls: program.funDecls.map(d => this.labelDeclaration(d)) };
    }
}
