"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
} from "recharts";
import kyInstance from "@/lib/ky";
import { useMusicPlayer } from "../MusicPlayerContext";
import { AlertCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EmotionData {
  currentEmotion: string | null;
  currentScore: number | null;
  chartData: Array<{ date: string; avgScore: number; emotion: string }>;
  alerts: Array<{
    type: "harmful" | "low-emotion";
    date: Date;
    message: string;
    postId: string;
    harmfulTypes?: string[];
  }>;
  recentPostsCount: number;
  countryCode: string | null;
  provinceCode: string | null;
  wisdomMessage: string | null;
}

interface MusicRecommendation {
  songTitle: string;
  artist: string;
  url: string;
  reason: string;
}

export default function MentalHealthDashboard() {
  const [data, setData] = useState<EmotionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [musicRecommendation, setMusicRecommendation] =
    useState<MusicRecommendation | null>(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [recentSongs, setRecentSongs] = useState<string[]>([]);
  const { setCurrentMusic, setIsPlaying, currentMusic } = useMusicPlayer();

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await kyInstance
          .get("/api/mental-health-data")
          .json<EmotionData>();
        setData(response);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching mental health data:", error);
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleRecommendMusic = async () => {
    if (!data) return;
    setMusicLoading(true);
    try {
      const response = await kyInstance
        .post("/api/recommend-music", {
          json: {
            emotion: data.currentEmotion,
            emotionScore: data.currentScore,
            recentSongs: recentSongs,
          },
        })
        .json<MusicRecommendation>();

      const songKey = `${response.songTitle} - ${response.artist}`;
      setRecentSongs((prev) => {
        const updated = [...prev, songKey];
        return updated.length > 20 ? updated.slice(-20) : updated;
      });

      setMusicRecommendation(response);
      setCurrentMusic(response);
      setIsPlaying(true);
    } catch (error) {
      console.error("Error recommending music:", error);
    } finally {
      setMusicLoading(false);
    }
  };

  const handlePlayRecommendation = () => {
    if (musicRecommendation) {
      setCurrentMusic(musicRecommendation);
      setIsPlaying(true);
    }
  };

  if (loading) {
    return (
      <div className="w-full space-y-5">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data || data.recentPostsCount === 0) {
    return (
      <div className="w-full space-y-5">
        <h1 className="text-3xl font-bold">Mental Health Dashboard</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No emotion data available yet. Start posting to track your
              emotional journey.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getEmotionColor = (emotion: string | null) => {
    switch (emotion) {
      case "POSITIVE":
        return "text-green-600";
      case "NEGATIVE":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  // Ensure these match the casing returned by your AI/Backend logic
  const crisisTypes = [
    "SELF_HARM",
    "SUICIDE",
    "EXTREME_DESPAIR",
    "self_harm",
    "suicide",
    "extreme_despair",
  ];

  return (
    <div className="w-full space-y-5">
      <h1 className="text-3xl font-bold">Mental Health Dashboard</h1>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Overall Emotion</p>
                <p
                  className={`text-2xl font-bold ${getEmotionColor(data.currentEmotion)}`}
                >
                  {data.currentEmotion || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Emotion Score</p>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 rounded-full bg-gray-200">
                    <div
                      className={`h-2 rounded-full ${
                        (data.currentScore || 0) >= 0.6
                          ? "bg-green-500"
                          : (data.currentScore || 0) <= 0.4
                            ? "bg-red-500"
                            : "bg-yellow-500"
                      }`}
                      style={{ width: `${(data.currentScore || 0) * 100}%` }}
                    />
                  </div>
                  <p className="text-lg font-semibold">
                    {((data.currentScore || 0) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Message for You</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.wisdomMessage ? (
              <p className="text-lg leading-relaxed">{data.wisdomMessage}</p>
            ) : (
              <p className="text-muted-foreground">
                Create a new post to receive personalized wisdom based on your
                emotions.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Music Recommendation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!musicRecommendation && (
              <div className="text-center">
                <p className="mb-4 text-muted-foreground">
                  Maybe you would like to listen to this song
                </p>
                <Button
                  onClick={handleRecommendMusic}
                  disabled={musicLoading}
                  className="w-full md:w-auto"
                >
                  {musicLoading
                    ? "Finding the perfect song..."
                    : "Get Music Recommendation"}
                </Button>
              </div>
            )}

            {musicRecommendation && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <h3 className="text-lg font-semibold">
                    {musicRecommendation.songTitle}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    by {musicRecommendation.artist}
                  </p>
                  <p className="mt-2 text-sm italic">
                    {musicRecommendation.reason}
                  </p>
                </div>
                <div className="flex gap-2">
                  {currentMusic?.url !== musicRecommendation.url && (
                    <Button
                      onClick={handlePlayRecommendation}
                      className="flex-1"
                    >
                      Play This Song
                    </Button>
                  )}
                  <Button
                    onClick={handleRecommendMusic}
                    disabled={musicLoading}
                    variant="outline"
                    className="flex-1"
                  >
                    {musicLoading ? "Loading..." : "Get Another Song"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {data.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alerts & Concerns</CardTitle>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <div className="space-y-3">
                {data.alerts.slice(0, 5).map((alert, index) => {
                  const isCrisisAlert =
                    alert.type === "harmful" &&
                    alert.harmfulTypes?.some((t) => crisisTypes.includes(t));

                  const alertElement = (
                    <Alert
                      variant={
                        alert.type === "harmful" ? "destructive" : "default"
                      }
                      className={
                        isCrisisAlert ? "cursor-pointer border-primary/50" : ""
                      }
                    >
                      <AlertDescription className="flex items-center justify-between">
                        <span>
                          <span className="font-medium">
                            {new Date(alert.date).toLocaleDateString()}:
                          </span>{" "}
                          {alert.message}
                        </span>
                        {isCrisisAlert && (
                          <Info className="size-4 animate-pulse text-primary" />
                        )}
                      </AlertDescription>
                    </Alert>
                  );

                  return isCrisisAlert ? (
                    <Tooltip key={index} delayDuration={0}>
                      <TooltipTrigger asChild>{alertElement}</TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="w-80 border-primary/20 bg-card p-4 text-card-foreground shadow-xl"
                      >
                        <div className="space-y-3">
                          <p className="flex items-center gap-2 font-bold text-primary">
                            <AlertCircle className="size-4" />
                            Help is Available
                          </p>
                          <p className="text-xs leading-relaxed">
                            We noticed you&apos;re going through a hard time.
                            Consider reach out to these 24/7 resources:
                          </p>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between rounded bg-muted p-2">
                              <span className="font-mono font-bold">988</span>
                              <span className="text-xs">Suicide Lifeline</span>
                            </div>
                            <div className="flex items-center justify-between rounded bg-muted p-2">
                              <span className="font-mono font-bold">
                                741741
                              </span>
                              <span className="text-right text-xs">
                                Text &quot;HELLO&quot;
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] italic text-muted-foreground">
                            We care about your well-being and your existence
                            matters.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div key={index}>{alertElement}</div>
                  );
                })}
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Emotion Trend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => {
                  const d = new Date(date);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
              />
              <YAxis
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              />
              <RechartsTooltip
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                formatter={(value: number) => [
                  `${(value * 100).toFixed(1)}%`,
                  "Score",
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="avgScore"
                stroke="#8884d8"
                strokeWidth={2}
                name="Emotion Score"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              Above 60%: Positive
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-800">
              40-60%: Neutral
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
              Below 40%: Negative
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
