export class UniqueId {
    private static counter = 0;

    static makeTemporary(): string {
        return `tmp.${this.counter++}`;
    }

    static makeLabel(prefix: string): string {
        return `${prefix}.${this.counter++}`;
    }
}
