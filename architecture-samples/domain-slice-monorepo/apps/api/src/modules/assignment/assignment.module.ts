import { InMemoryAssignmentRepository } from "./infrastructure/persistence/assignment.repository.js";
import { ConsoleAssignmentOutbox } from "./infrastructure/outbox/assignment.outbox.js";
import { ConsoleAssignmentLogger } from "./infrastructure/logging/assignment.logger.js";
import { RepositoryAssignmentReadModel } from "./infrastructure/read-model/assignment.read-model.js";
import { InMemoryAssignmentTransaction } from "./infrastructure/transaction/assignment.transaction.js";
import { AssignmentUseCase } from "./application/use-cases/assignment.use-case.js";
import { AssignmentController } from "./presentation/http/assignment.controller.js";
import { AssignmentDetailBff } from "./presentation/bff/assignment-detail.bff.js";
import { AssignmentDetailController } from "./presentation/bff/assignment-detail.controller.js";
import { TransactionalAssignmentStore } from "./infrastructure/transaction/assignment.unit-of-work.js";

const store = new TransactionalAssignmentStore();
const repository = new InMemoryAssignmentRepository(store);
const outbox = new ConsoleAssignmentOutbox(store);
const transaction = new InMemoryAssignmentTransaction(store);
const logger = new ConsoleAssignmentLogger();
const readModel = new RepositoryAssignmentReadModel(repository);
const useCase = new AssignmentUseCase(repository, outbox, transaction, logger);
const bff = new AssignmentDetailBff(readModel, logger);

export const ASSIGNMENT_MODULE = {
  moduleName: "assignment",
  controller: new AssignmentController(useCase),
  bff,
  bffController: new AssignmentDetailController(bff),
};
