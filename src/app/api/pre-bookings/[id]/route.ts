import { PreBooking } from "@/backend/models/PreBooking";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(PreBooking).item;
