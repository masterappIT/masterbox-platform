import React from "react";

export default function Features() {
  const features = [
    {
      icon: 1,
      title: "繁體中文",
    },
    {
      icon: 2,
      title: "登出",
    },
  ];

  return (
    <div>
      {features.map((feature,i) => {
        return (
          <div key={i} className="flex flex">
            <div className="text-xl">{feature["icon"]}</div>
            <div className="text-xl">{feature["title"]}</div>
          </div>
        );
      })}
    </div>
  );
}
