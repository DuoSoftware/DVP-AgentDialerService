#FROM ubuntu
#RUN apt-get update
#RUN apt-get install -y git nodejs npm nodejs-legacy
#RUN git clone https://github.com/DuoSoftware/DVP-AgentDialerService.git /usr/local/src/agentdialerservice
#RUN cd /usr/local/src/agentdialerservice; npm install
#CMD ["nodejs", "/usr/local/src/agentdialerservice/app.js"]

#EXPOSE 8895

FROM node:argon
ARG VERSION_TAG
RUN git clone -b $VERSION_TAG https://github.com/DuoSoftware/DVP-AgentDialerService.git /usr/local/src/agentdialerservice
RUN cd /usr/local/src/agentdialerservice;
WORKDIR /usr/local/src/agentdialerservice
RUN npm install
EXPOSE 8895
CMD [ "node", "/usr/local/src/agentdialerservice/app.js" ]
