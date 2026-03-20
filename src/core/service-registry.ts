// Responsável por registrar e expor serviços de runtime por domínio sem recorrer a singletons globais.
export type ServiceMap = Record<string, unknown>;

export type ServiceRegistry<Services extends ServiceMap> = {
  register: <ServiceName extends keyof Services>(serviceName: ServiceName, service: Services[ServiceName]) => void;
  unregister: <ServiceName extends keyof Services>(serviceName: ServiceName) => void;
  has: <ServiceName extends keyof Services>(serviceName: ServiceName) => boolean;
  resolve: <ServiceName extends keyof Services>(serviceName: ServiceName) => Services[ServiceName] | null;
  require: <ServiceName extends keyof Services>(serviceName: ServiceName) => Services[ServiceName];
  clear: () => void;
};

export function createServiceRegistry<Services extends ServiceMap>(): ServiceRegistry<Services> {
  const services = new Map<keyof Services, Services[keyof Services]>();

  return {
    register: (serviceName, service) => {
      services.set(serviceName, service);
    },
    unregister: (serviceName) => {
      services.delete(serviceName);
    },
    has: (serviceName) => {
      return services.has(serviceName);
    },
    resolve: (serviceName) => {
      return (services.get(serviceName) as Services[typeof serviceName] | undefined) ?? null;
    },
    require: (serviceName) => {
      const service = services.get(serviceName) as Services[typeof serviceName] | undefined;
      if (typeof service === "undefined") {
        throw new Error(`[game][registry] Service '${String(serviceName)}' is not registered.`);
      }

      return service;
    },
    clear: () => {
      services.clear();
    }
  };
}
