from pydantic import BaseModel, model_validator


class HealthConfigRequest(BaseModel):
    preset_key: str | None = None
    config: dict | None = None

    @model_validator(mode="after")
    def exactly_one_choice(self):
        if (self.preset_key is None) == (self.config is None):
            raise ValueError("provide exactly one of preset_key or config")
        return self
