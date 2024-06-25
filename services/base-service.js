module.exports = class BaseService {
  constructor(name, schedule) {
    if (new.target === BaseService) {
      throw new TypeError("Cannot construct BaseService instances directly");
    }
    this.name = name;
    this.schedule = schedule;
  }
  async run() {
    throw new Error('Service method "run" not implemented');
  }
};
