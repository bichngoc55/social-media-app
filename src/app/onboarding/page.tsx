"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper, Step } from "@/components/ui/stepper";
import { useToast } from "@/components/ui/use-toast";
import kyInstance from "@/lib/ky";
import {
  getAllCountries,
  getProvinces,
  getDistricts,
} from "@/lib/location-data";

const INTEREST_TAGS = [
  "Technology",
  "Sports",
  "Music",
  "Art",
  "Travel",
  "Food",
  "Fashion",
  "Photography",
  "Gaming",
  "Fitness",
  "Books",
  "Movies",
  "Science",
  "Business",
  "Education",
  "Health",
  "Nature",
  "Pets",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [countryCode, setCountryCode] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [districtCode, setDistrictCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const countries = useMemo(() => getAllCountries(), []);
  const provinces = useMemo(
    () => (countryCode ? getProvinces(countryCode) : []),
    [countryCode]
  );
  const districts = useMemo(
    () =>
      countryCode && provinceCode
        ? getDistricts(countryCode, provinceCode)
        : [],
    [countryCode, provinceCode]
  );

  const handleInterestToggle = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleCountryChange = (value: string) => {
    setCountryCode(value);
    setProvinceCode("");
    setDistrictCode("");
  };

  const handleProvinceChange = (value: string) => {
    setProvinceCode(value);
    setDistrictCode("");
  };

  const handleDistrictChange = (value: string) => {
    setDistrictCode(value);
  };

  const handleSubmit = async () => {
    if (selectedInterests.length < 3) {
      toast({
        variant: "destructive",
        description: "Please select at least 3 interests",
      });
      return;
    }

    if (!countryCode) {
      toast({
        variant: "destructive",
        description: "Please select your country",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await kyInstance.post("/api/user/onboarding", {
        json: {
          interests: selectedInterests,
          countryCode,
          provinceCode: provinceCode || null,
          districtCode: districtCode || null,
        },
      });

      toast({
        description:
          "Profile updated successfully! Redirecting to main page...",
      });

      // Wait a moment for user to see the message, then redirect
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        variant: "destructive",
        description: "Failed to update profile. Please try again.",
      });
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && selectedInterests.length < 3) {
      toast({
        variant: "destructive",
        description: "Please select at least 3 interests",
      });
      return;
    }
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            Welcome to Loopy!
          </CardTitle>
          <p className="text-center text-muted-foreground">
            Choose at least 3 interests - we&apos;ll learn your preferences as
            you explore
          </p>
          <div className="mt-6">
            <Stepper currentStep={step}>
              <Step step={1} title="Interests" />
              <Step step={2} title="Location" />
            </Stepper>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <>
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold">
                    Select your interests{" "}
                    <span className="text-muted-foreground">(minimum 3)</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedInterests.length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_TAGS.map((interest) => {
                    const isSelected = selectedInterests.includes(interest);
                    const isDisabled = false;
                    return (
                      <Badge
                        key={interest}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer ${
                          isDisabled ? "cursor-not-allowed opacity-50" : ""
                        }`}
                        onClick={() => {
                          if (!isDisabled) {
                            handleInterestToggle(interest);
                          }
                        }}
                      >
                        {interest}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleNext}
                disabled={selectedInterests.length < 3}
              >
                Next
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-4">
                <h3 className="font-semibold">Select your location</h3>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Country *</label>
                  <Select
                    value={countryCode}
                    onValueChange={handleCountryChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem
                          key={country.id}
                          value={country.id.toString()}
                        >
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {countryCode && provinces.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Province/State (Optional)
                    </label>
                    <Select
                      value={provinceCode}
                      onValueChange={handleProvinceChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select province" />
                      </SelectTrigger>
                      <SelectContent>
                        {provinces.map((province) => (
                          <SelectItem
                            key={province.id}
                            value={province.id.toString()}
                          >
                            {province.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {countryCode && provinceCode && districts.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      District/City (Optional)
                    </label>
                    <Select
                      value={districtCode}
                      onValueChange={handleDistrictChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {districts.map((district) => (
                          <SelectItem
                            key={district.id}
                            value={district.id.toString()}
                          >
                            {district.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleBack}
                >
                  Back
                </Button>
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={!countryCode || isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Complete Setup"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
