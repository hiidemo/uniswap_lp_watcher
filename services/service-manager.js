const Notifier = require("../notifier");
const ServiceStatus = require("./service-status");
const manager = {
  add: function (service) {
    service.status = ServiceStatus.QUEUED;
    this.services.push(service);
  },
  start: async function (service = null) {
    for (const service of this.services) {
      this.run(service);
      if (service.schedule) {
		service.interval = setInterval(() => this.run(service), service.schedule);
	  }
    }
  },
  stop: function (service) {
    clearInterval(service.interval);
    service.status = ServiceStatus.STOPPED;
  },
  restart: function (service) {
    this.stop(service);
    this.start(service);
  },
  run: async function (service) {
    try {
      service.run();
      service.status = ServiceStatus.RUNNING;
    } catch (err) {
      console.log("[ERROR] " + service.name + ": " + err);
      this.stop(service);
      Notifier.notify(service.name + " Error", "Service failed");
    }
  },
};
manager.services = [];
module.exports = manager;
