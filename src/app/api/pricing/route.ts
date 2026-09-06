import { PricingRoute } from "@/backend/models/PricingRoute";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(PricingRoute).collection;
