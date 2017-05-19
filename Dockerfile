#FROM ubuntu
#RUN apt-get update
#RUN apt-get install -y git nodejs npm nodejs-legacy
#RUN git clone https://github.com/DuoSoftware/DVP-AgentDialerService.git /usr/local/src/AgentDialerService
#RUN cd /usr/local/src/AgentDialerService; npm install
#CMD ["nodejs", "/usr/local/src/AgentDialerService/app.js"]

#EXPOSE 8895

FROM node:argon
RUN git clone https://github.com/DuoSoftware/DVP-AgentDialerService.git /usr/local/src/AgentDialerService
RUN cd /usr/local/src/AgentDialerService;
WORKDIR /usr/local/src/AgentDialerService
RUN npm install
EXPOSE 8895
CMD [ "node", "/usr/local/src/AgentDialerService/app.js" ]
