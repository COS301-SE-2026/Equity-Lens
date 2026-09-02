from pydantic import BaseModel, ConfigDict, Field, model_validator


class HealthConfigRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"preset_key": "capital_preservation"},
                {
                    "config": {
                        "weight_sector_concentration": 0.4,
                        "weight_single_position": 0.35,
                        "weight_breadth": 0.25,
                        "concentration_low": 25,
                        "concentration_high": 45,
                        "hhi_well_spread": 0.15,
                        "breadth_target_n": 8,
                    }
                },
            ]
        }
    )

    preset_key: str | None = Field(
        default=None,
        description="one of the keys from GET /health-config presets",
        examples=["capital_preservation"],
    )
    config: dict | None = Field(
        default=None,
        description="all seven HealthConfigValues fields, each inside the published "
                    "bounds, with the three weights summing to 1",
    )

    @model_validator(mode="after")
    def exactly_one_choice(self):
        if (self.preset_key is None) == (self.config is None):
            raise ValueError("provide exactly one of preset_key or config")
        return self
