interface PrefixErrorConfig {
  name: string;
  prefix: string;
  suffix?: string;
}

export default class PrefixError {
  private name: string;
  private prefix: string;
  private suffix?: string;

  constructor(config: PrefixErrorConfig) {
    this.name = config.name;
    this.prefix = config.prefix;
    this.suffix = config.suffix;
  }

  public Create() {
    const name = this.name;
    const prefix = this.prefix;
    const suffix = this.suffix;

    return class extends Error {
      constructor(message: string) {
        super(`${prefix}${message}${suffix ? ` ${suffix}` : ""}`);
        this.name = name;
      }
    };
  }
}
