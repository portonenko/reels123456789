import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Video, Wand2, Music, LogIn, Image } from "lucide-react";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        {/* Hero section */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Video Creation</span>
          </div>
          
          <h1 className="text-6xl font-bold tracking-tight">
            Turn Text Into
            <span className="block bg-gradient-primary bg-clip-text text-transparent">
              Stunning Reels
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Paste your content, customize styling, and export professional vertical videos in minutes. 
            No editing skills required.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            className="bg-gradient-primary hover:opacity-90 text-lg px-8 py-6 h-auto"
            onClick={() => navigate("/auth")}
          >
            <LogIn className="w-5 h-5 mr-2" />
            Sign In / Sign Up
          </Button>
          
          <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 py-6 h-auto"
            onClick={() => navigate("/gallery")}
          >
            <Wand2 className="w-5 h-5 mr-2" />
            Video Gallery
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 py-6 h-auto"
            onClick={() => navigate("/photos")}
          >
            <Image className="w-5 h-5 mr-2" />
            Photo Gallery
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 py-6 h-auto"
            onClick={() => navigate("/music")}
          >
            <Music className="w-5 h-5 mr-2" />
            Music Gallery
          </Button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-16 text-left">
          <div className="bg-card rounded-lg p-6 border border-border">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Smart Parsing</h3>
            <p className="text-sm text-muted-foreground">
              Automatically converts your text into perfectly timed slides with intelligent duration control
            </p>
          </div>

          <div className="bg-card rounded-lg p-6 border border-border">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
              <Wand2 className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Custom Styling</h3>
            <p className="text-sm text-muted-foreground">
              Full control over fonts, colors, shadows, and backgrounds for each slide
            </p>
          </div>

          <div className="bg-card rounded-lg p-6 border border-border">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Video className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Video Backgrounds</h3>
            <p className="text-sm text-muted-foreground">
              Upload your own videos and randomize backgrounds for dynamic content
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
