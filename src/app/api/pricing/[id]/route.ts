import { PricingRoute } from "@/backend/models/PricingRoute";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(PricingRoute).item;
