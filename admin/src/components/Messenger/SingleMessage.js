import React from "react";

export default function SingleMessage(props) {
  return (
    <div className="single-message">
      <div className="single-message-headshot">
        {props.message["headshot"]}
        <img></img>
      </div>
      <div className="single-message-account-info">
        <p className="account">{props.message["name"]}</p>
        <p className="message">{props.message["content"]}</p>
      </div>
      <span className="unread-notification">
        {props.message["unread"] ? props.message["unread"] : ""}
      </span>
      <div className="layout-space"></div>
    </div>
  );
}
